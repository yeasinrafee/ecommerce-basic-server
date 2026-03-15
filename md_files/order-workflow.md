# Order Workflow - API

## Overview
This document outlines the detailed workflow and logic implemented in the `createOrder` API. The API is designed to handle custom validations, discounts, stock updates, zone policies, tax, and extra shipping costs, making sure edge cases and race conditions are mitigated correctly utilizing Prisma Transactions.

## 1. Authorization
- The route is protected by `authenticateUser` and `authorizeRoles(Role.CUSTOMER)` middleware.
- Only a customer can place an order.
- The user ID is fetched from the request object populated by the auth guard (`req.user.id`).

## 2. Customer Validation
- The `userId` is used to verify and fetch the corresponding `customerId`.
- If a customer is not found, a `404` error is appropriately thrown.

## 3. Address Handling
- **Existing Address**: If `addressId` is provided by the frontend, the system validates whether it actually exists and whether it belongs to the authenticated customer. Extract the `zoneId` from this existing address record.
- **New Address**: If `addressId` is missing but new address data is provided in the payload, a new Address record is created pointing to this customer. The new `zoneId` is then associated.
- An error is thrown if neither is provided.

## 4. Promo Discount Validation
- The optionally provided `promoId` is checked for validity:
  - Validates active status checking both `startDate` and `endDate` boundaries against the `currentDate`.
  - Determines via aggregate count how many times this specific `couponType` has already been used by this customer.
  - If used >= `numberOfUses`, it rightfully throws an error to restrict redundant consumptions.

## 5. Product & Product-Level Discounts Processing
- Iterates over all requested products and executes database queries dynamically, but sequentially (via transaction context) to retrieve latest product snapshots.
- **Race Condition Prevention**: Decrements the `product.stock` instantly in the transaction (`{ decrement: quantity }`). Afterward, it checks if `stock < 0`. This strictly safeguards against two simultaneous orders exhausting the exact same item. If `< 0`, throws a Concurrency Error and rollbacks the transaction automatically.
- Processes each product item independently checking:
  - If the product currently has an active discount block bounded by `discountStartDate` and `discountEndDate`. 
  - Generates the updated item `finalPrice` relying seamlessly on `discountType` (`FLAT_DISCOUNT` vs `PERCENTAGE_DISCOUNT`).
  - Cumulates the `baseAmount` (the base core logic for the overarching Order model) efficiently.
- Measures global total volume and weight sequentially for the shipping computation logic.

## 6. Promo Validation on Cart Level
- If the Promo checks in step 4 pass successfully, calculate the overarching `orderDiscountValue` based on total `baseAmount` retrieved across all verified products.
- Resolves to `amountAfterPromo`.

## 7. Base Shipping + Zone Policy Constraints
- Utilizes the `zoneId` assigned globally during Step 3, connecting cleanly with the `ZonePolicy` relationships (`zonePoliciesOnZones`).
- Fetches the active `deliveryTime` and `baseShippingCharge` corresponding strictly to `zoneId`.
- Without zone configuration bounds, throws a `400` Error indicating shipping limitations precisely.

## 8. Progressive Shipping Strategy
- Extracts default settings out of the `Shipping` model (i.e., extra limits, unifier elements, flat tax).
- Evaluates total calculated volumes vs weights for custom scaling charge logic:
  - Uses `weightUnit` scaling multiplied by `chargePerWeight`.
  - Same principle iteratively enforced for `volumeUnit` and `chargePerVolume`.
- Evaluates `finalShippingCharge`.

## 9. Tax Calculation & Total Summation
- `taxAmount` evaluates via default percentages parsed strictly against `amountAfterPromo` metrics.
- Computations finalize for `finalAmount` equaling `amountAfterPromo` + `finalShippingCharge` + `tax`. 

## 10. Expected Delivery Computation
- Incorporates the scalar float `deliveryTime` seamlessly into a standardized mutable Date object representation scaling forward dynamically reflecting `expectedDeliveryDate`.

## 11. Database Snapshot Persistence
- In tandem with order root details scaling to relations dynamically via `orderItems: { create: [...] }`, writes the snapshot history covering frozen finalities of product records (Prices, Active Discounts applied internally, Validations) resolving external tampering mutations in future.

This entire sequence safely sits localized fully inside a resilient isolated database Prisma Transaction logic resolving race conflicts precisely.

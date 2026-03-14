# Review Module Documentation

This module handles **Blog Comments** and **Product Reviews**.

## General Rules
- **Public APIs:** All `GET` requests are public.
- **Protected APIs:** `POST`, `PATCH`, and `DELETE` requests require authentication and are restricted to users with the **Customer** (`Role.CUSTOMER`) role.
- **Replies:** If a `parentId` is provided, the entry is treated as a reply. Replies to product reviews do not require a `rating`.
- **Product Ratings:** Adding, updating, or deleting a top-level product review automatically recalculates the product's `avgRating`, `totalRatings`, and `totalReviews`.

---

## 1. Blog Comments

### Add a Comment / Reply
- **URL:** `POST /api/reviews/blog/comment`
- **Body:**
```json
{
  "blogId": "uuid",
  "content": "Your comment here",
  "parentId": "uuid (optional for replies)"
}
```

### Update a Comment
- **URL:** `PATCH /api/reviews/blog/comment/:commentId`
- **Body:**
```json
{
  "content": "Updated comment content"
}
```

### Delete a Comment
- **URL:** `DELETE /api/reviews/blog/comment/:commentId`

### Get Blog Comments
- **URL:** `GET /api/reviews/blog/:blogId/comments`
- **Description:** Returns a list of top-level comments with their nested replies.

---

## 2. Product Reviews

### Add a Review / Reply
- **URL:** `POST /api/reviews/product/review`
- **Body:**
```json
{
  "productId": "id",
  "content": "Your review here",
  "rating": 5, 
  "parentId": "uuid (optional for replies)"
}
```

### Update a Review
- **URL:** `PATCH /api/reviews/product/review/:reviewId`
- **Body:**
```json
{
  "content": "Updated review content",
  "rating": 4 
}
```

### Delete a Review
- **URL:** `DELETE /api/reviews/product/review/:reviewId`

### Get Product Reviews
- **URL:** `GET /api/reviews/product/:productId/reviews`
- **Description:** Returns a list of top-level reviews with their nested replies and the user information.

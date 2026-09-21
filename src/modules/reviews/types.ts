export type PublicReview = {
  id: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
  productName: string;
  productImage: string | null;
  verified: boolean;
};

export type ReviewableProduct = {
  id: string;
  name: string;
  image: string | null;
  currentRating: number | null;
  currentComment: string;
  reviewedAt: string | null;
};

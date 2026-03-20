import type {
  GetShotReviewSummaryResponse,
  ListEvaluationRunsResponse,
  ListShotReviewsResponse,
} from "../../gen/hualala/review/v1/review_pb";
import { createHualalaClient, type HualalaClientOptions } from "../transport";

export function createReviewClient(options: HualalaClientOptions = {}) {
  const client = createHualalaClient(options);

  return {
    getShotReviewSummary(body: { shotExecutionId: string }) {
      return client.unary<GetShotReviewSummaryResponse>(
        "/hualala.review.v1.ReviewService/GetShotReviewSummary",
        body,
        "sdk: failed to get shot review summary",
      );
    },
    listEvaluationRuns(body: { shotExecutionId: string }) {
      return client.unary<ListEvaluationRunsResponse>(
        "/hualala.review.v1.ReviewService/ListEvaluationRuns",
        body,
        "sdk: failed to list evaluation runs",
      );
    },
    listShotReviews(body: { shotExecutionId: string }) {
      return client.unary<ListShotReviewsResponse>(
        "/hualala.review.v1.ReviewService/ListShotReviews",
        body,
        "sdk: failed to list shot reviews",
      );
    },
  };
}

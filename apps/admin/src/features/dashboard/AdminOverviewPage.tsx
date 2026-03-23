import type { AdminTranslator, LocaleCode } from "../../i18n";
import type {
  AdminOperationsOverviewViewModel,
  AdminOperationsRouteTarget,
} from "./operationsOverview";
import type { AdminOverviewViewModel } from "./overview";
import { AdminOverviewHeader } from "./overview-page/AdminOverviewHeader";
import { AdminOverviewSummaryPanels } from "./overview-page/AdminOverviewSummaryPanels";
import { type FeedbackMessage } from "./overview-page/shared";

type AdminOverviewPageProps = {
  overview: AdminOverviewViewModel;
  operationsOverview: AdminOperationsOverviewViewModel | null;
  locale: LocaleCode;
  t: AdminTranslator;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  onNavigateOperationsTarget?: (target: AdminOperationsRouteTarget) => void;
  budgetFeedback?: FeedbackMessage;
};

export function AdminOverviewPage({
  overview,
  operationsOverview,
  locale,
  t,
  onUpdateBudgetLimit,
  onNavigateOperationsTarget,
  budgetFeedback,
}: AdminOverviewPageProps) {
  return (
    <div
      style={{
        width: "min(1280px, 100%)",
        margin: "0 auto",
        display: "grid",
        gap: "24px",
      }}
    >
      <AdminOverviewHeader overview={overview} locale={locale} t={t} />

      <AdminOverviewSummaryPanels
        overview={overview}
        operationsOverview={operationsOverview}
        t={t}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        onNavigateOperationsTarget={onNavigateOperationsTarget}
        budgetFeedback={budgetFeedback}
      />
    </div>
  );
}

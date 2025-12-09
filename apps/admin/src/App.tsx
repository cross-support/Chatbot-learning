import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useToast, setGlobalToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';

// 遅延ロードするページコンポーネント
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ScenarioPage = lazy(() => import('./pages/ScenarioPage'));
const ScenarioEditorPage = lazy(() => import('./pages/ScenarioEditorPage'));
const RtChatPage = lazy(() => import('./pages/RtChatPage'));
const RtChatSettingsPage = lazy(() => import('./pages/RtChatSettingsPage'));
const TemplatePage = lazy(() => import('./pages/TemplatePage'));
const TemplateNewPage = lazy(() => import('./pages/TemplateNewPage'));
const TemplateEditPage = lazy(() => import('./pages/TemplateEditPage'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'));
const OperatorsPage = lazy(() => import('./pages/OperatorsPage'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage'));
const ApplicationNewPage = lazy(() => import('./pages/ApplicationNewPage'));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage'));
const NGWordsPage = lazy(() => import('./pages/NGWordsPage'));
const RoutingPage = lazy(() => import('./pages/RoutingPage'));
const OffHoursInquiriesPage = lazy(() => import('./pages/OffHoursInquiriesPage'));
const CompanySettingsPage = lazy(() => import('./pages/CompanySettingsPage'));
const WidgetSettingsPage = lazy(() => import('./pages/WidgetSettingsPage'));
const PasswordPolicyPage = lazy(() => import('./pages/PasswordPolicyPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const UserNewPage = lazy(() => import('./pages/UserNewPage'));
const UserEditPage = lazy(() => import('./pages/UserEditPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const ABTestPage = lazy(() => import('./pages/ABTestPage'));
const OperatorStatsPage = lazy(() => import('./pages/OperatorStatsPage'));
const WebhookSettingsPage = lazy(() => import('./pages/WebhookSettingsPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const IpWhitelistPage = lazy(() => import('./pages/IpWhitelistPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const RichMessagePage = lazy(() => import('./pages/RichMessagePage'));
const TranslationsPage = lazy(() => import('./pages/TranslationsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProactivePage = lazy(() => import('./pages/ProactivePage'));

// ローディングコンポーネント
function PageLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600 text-sm">読み込み中...</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const toast = useToast();

  useEffect(() => {
    setGlobalToast(toast);
  }, [toast]);

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/scenarios"
            element={
              <PrivateRoute>
                <ScenarioPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/scenarios/:id/edit"
            element={
              <PrivateRoute>
                <ScenarioEditorPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/scenarios/new"
            element={
              <PrivateRoute>
                <ScenarioEditorPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rtchat"
            element={
              <PrivateRoute>
                <RtChatPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rtchat/settings"
            element={
              <PrivateRoute>
                <RtChatSettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rtchat/ng-words"
            element={
              <PrivateRoute>
                <NGWordsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rtchat/routing"
            element={
              <PrivateRoute>
                <RoutingPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rtchat/off-hours-inquiries"
            element={
              <PrivateRoute>
                <OffHoursInquiriesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <PrivateRoute>
                <TemplatePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/templates/new"
            element={
              <PrivateRoute>
                <TemplateNewPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/templates/:id/edit"
            element={
              <PrivateRoute>
                <TemplateEditPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <PrivateRoute>
                <StatisticsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/operators"
            element={
              <PrivateRoute>
                <OperatorsPage />
              </PrivateRoute>
            }
          />
          {/* Applications */}
          <Route
            path="/applications"
            element={
              <PrivateRoute>
                <ApplicationsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/applications/new"
            element={
              <PrivateRoute>
                <ApplicationNewPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <PrivateRoute>
                <ApplicationDetailPage />
              </PrivateRoute>
            }
          />
          {/* Settings */}
          <Route
            path="/settings/company"
            element={
              <PrivateRoute>
                <CompanySettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/widget"
            element={
              <PrivateRoute>
                <WidgetSettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/password-policy"
            element={
              <PrivateRoute>
                <PasswordPolicyPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/users"
            element={
              <PrivateRoute>
                <UsersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/users/new"
            element={
              <PrivateRoute>
                <UserNewPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/users/:id/edit"
            element={
              <PrivateRoute>
                <UserEditPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <PrivateRoute>
                <NotificationsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/monitoring"
            element={
              <PrivateRoute>
                <MonitoringPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/abtests"
            element={
              <PrivateRoute>
                <ABTestPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/statistics/operators"
            element={
              <PrivateRoute>
                <OperatorStatsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/webhooks"
            element={
              <PrivateRoute>
                <WebhookSettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/api-keys"
            element={
              <PrivateRoute>
                <ApiKeysPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/integrations"
            element={
              <PrivateRoute>
                <IntegrationsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/audit-log"
            element={
              <PrivateRoute>
                <AuditLogPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/ip-whitelist"
            element={
              <PrivateRoute>
                <IpWhitelistPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/faq"
            element={
              <PrivateRoute>
                <FaqPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/rich-messages"
            element={
              <PrivateRoute>
                <RichMessagePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings/translations"
            element={
              <PrivateRoute>
                <TranslationsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <AnalyticsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/proactive"
            element={
              <PrivateRoute>
                <ProactivePage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/rtchat" />} />
        </Routes>
      </Suspense>
    </>
  );
}

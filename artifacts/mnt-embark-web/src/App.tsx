import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@workspace/mnt-embark/components/ui/toaster';
import { TooltipProvider } from '@workspace/mnt-embark/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import ToursPage from '@/pages/tours';
import TourDetailPage from '@/pages/tour-detail-slug';
import DestinationsPage from '@/pages/destinations';
import CategoriesPage from '@/pages/categories';
import JournalsPage from '@/pages/journals';
import JournalDetailPage from '@/pages/journal-detail';
import ActivityDetailPage from '@/pages/activity-detail';
import ActivitiesPage from '@/pages/activities';
import GuidePage from '@/pages/guide';
import AboutPage from '@/pages/about';
import ContactPage from '@/pages/contact';
import AdminToursPage from '@/pages/admin/tours';
import AdminDestinationsPage from '@/pages/admin/destinations';
import AdminCategoriesPage from '@/pages/admin/categories';
import AdminJournalsPage from '@/pages/admin/journals';
import AdminEnquiriesPage from '@/pages/admin/enquiries';
import AdminLoginPage from '@/pages/admin/login';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { AdminGuard } from '@/components/AdminGuard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/tours" component={ToursPage} />
      <Route path="/tours/:slugOrId" component={TourDetailPage} />
      <Route path="/destinations" component={DestinationsPage} />
      <Route path="/categories" component={CategoriesPage} />
      <Route path="/journals" component={JournalsPage} />
      <Route path="/journals/:id" component={JournalDetailPage} />
      <Route path="/activities" component={ActivitiesPage} />
      <Route path="/activities/:slug" component={ActivityDetailPage} />
      <Route path="/guide" component={GuidePage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin">
        <AdminGuard><Redirect to="/admin/tours" /></AdminGuard>
      </Route>
      <Route path="/admin/tours">
        <AdminGuard><AdminToursPage /></AdminGuard>
      </Route>
      <Route path="/admin/destinations">
        <AdminGuard><AdminDestinationsPage /></AdminGuard>
      </Route>
      <Route path="/admin/categories">
        <AdminGuard><AdminCategoriesPage /></AdminGuard>
      </Route>
      <Route path="/admin/journals">
        <AdminGuard><AdminJournalsPage /></AdminGuard>
      </Route>
      <Route path="/admin/enquiries">
        <AdminGuard><AdminEnquiriesPage /></AdminGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

export default App;

import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@workspace/mnt-embark/components/ui/toaster';
import { TooltipProvider } from '@workspace/mnt-embark/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { AdminGuard } from '@/components/AdminGuard';

/*
 * Route-level code splitting.
 *
 * Every page used to be imported eagerly, so a visitor landing on the homepage
 * downloaded the entire site — including all six admin screens they can never
 * open — before anything rendered.
 *
 * Home stays eager: it is the most common entry point and lazy-loading it would
 * only add a round trip before first paint. Everything else loads on navigation.
 */
import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';

const ToursPage = lazy(() => import('@/pages/tours'));
const TourDetailPage = lazy(() => import('@/pages/tour-detail-slug'));
const DestinationsPage = lazy(() => import('@/pages/destinations'));
const CategoriesPage = lazy(() => import('@/pages/categories'));
const JournalsPage = lazy(() => import('@/pages/journals'));
const JournalDetailPage = lazy(() => import('@/pages/journal-detail'));
const ActivitiesPage = lazy(() => import('@/pages/activities'));
const ActivityDetailPage = lazy(() => import('@/pages/activity-detail'));
const GuidePage = lazy(() => import('@/pages/guide'));
const AboutPage = lazy(() => import('@/pages/about'));
const ContactPage = lazy(() => import('@/pages/contact'));

// Admin. Never reached by a visitor, so it should never be in their download.
const AdminLoginPage = lazy(() => import('@/pages/admin/login'));
const AdminToursPage = lazy(() => import('@/pages/admin/tours'));
const AdminDestinationsPage = lazy(() => import('@/pages/admin/destinations'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/categories'));
const AdminJournalsPage = lazy(() => import('@/pages/admin/journals'));
const AdminEnquiriesPage = lazy(() => import('@/pages/admin/enquiries'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

/**
 * Shown while a route chunk downloads. Deliberately plain — on a fast
 * connection it appears for a few frames, and anything more elaborate reads as
 * a flash of unrelated content.
 */
function RouteFallback() {
  return <div className="min-h-screen" aria-busy="true" />;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
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

import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@workspace/mnt-embark/components/ui/toaster';
import { TooltipProvider } from '@workspace/mnt-embark/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation, useParams } from 'wouter';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { AdminGuard } from '@/components/AdminGuard';
import { TripProvider } from '@/lib/trip';

/*
 * Route-level code splitting.
 *
 * Every page used to be imported eagerly, so a visitor landing on the homepage
 * downloaded the entire site — including every admin screen they can never
 * open — before anything rendered.
 *
 * Home stays eager: it is the most common entry point and lazy-loading it would
 * only add a round trip before first paint. Everything else loads on navigation.
 */
import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';

// The first-visit planner and its globe. Lazy: its animation code is only for visitors.
const TripPlanner = lazy(() => import('@/components/planner/TripPlanner'));
const AttractionsPage = lazy(() => import('@/pages/attractions'));
const AttractionDetailPage = lazy(() => import('@/pages/attraction-detail'));
const DestinationsPage = lazy(() => import('@/pages/destinations'));
const CountryDetailPage = lazy(() => import('@/pages/country-detail'));
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
const AdminAttractionsPage = lazy(() => import('@/pages/admin/attractions'));
const AdminDestinationsPage = lazy(() => import('@/pages/admin/destinations'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/categories'));
const AdminJournalsPage = lazy(() => import('@/pages/admin/journals'));
const AdminEnquiriesPage = lazy(() => import('@/pages/admin/enquiries'));
const AdminEmailTemplatesPage = lazy(() => import('@/pages/admin/email-templates'));
const AdminActivitiesPage = lazy(() => import('@/pages/admin/activities'));
const AdminGuidesPage = lazy(() => import('@/pages/admin/guides'));
const AdminAdminsPage = lazy(() => import('@/pages/admin/admins'));

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

/**
 * An old /tours/<slug> link. Tours are hidden for now and have no page, so it
 * lands on the attractions list, searching for the words in the old address -
 * "/tours/sahara-under-a-billion-stars" becomes a search for "sahara under a
 * billion stars", which is the closest thing to what the visitor wanted.
 */
function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/destinations" component={DestinationsPage} />
        <Route path="/destinations/:slug" component={CountryDetailPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />

        {/* Redirect other public paths to destinations */}
        <Route path="/attractions"><Redirect to="/destinations" replace /></Route>
        <Route path="/attractions/:slug"><Redirect to="/destinations" replace /></Route>
        <Route path="/tours"><Redirect to="/destinations" replace /></Route>
        <Route path="/tours/:slug"><Redirect to="/destinations" replace /></Route>
        <Route path="/flights"><Redirect to="/destinations" replace /></Route>
        <Route path="/flights/:slug"><Redirect to="/destinations" replace /></Route>
        <Route path="/hotels"><Redirect to="/destinations" replace /></Route>
        <Route path="/guide"><Redirect to="/destinations" replace /></Route>
        <Route path="/categories"><Redirect to="/destinations" replace /></Route>
        <Route path="/journals"><Redirect to="/destinations" replace /></Route>
        <Route path="/journals/:id"><Redirect to="/destinations" replace /></Route>
        <Route path="/activities"><Redirect to="/destinations" replace /></Route>
        <Route path="/activities/:slug"><Redirect to="/destinations" replace /></Route>

        {/* Admin routes */}
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          <AdminGuard><Redirect to="/admin/destinations" /></AdminGuard>
        </Route>
        <Route path="/admin/attractions">
          <AdminGuard><AdminAttractionsPage /></AdminGuard>
        </Route>
        <Route path="/admin/tours">
          <AdminGuard><Redirect to="/admin/destinations" /></AdminGuard>
        </Route>
        <Route path="/admin/destinations">
          <AdminGuard><AdminDestinationsPage /></AdminGuard>
        </Route>
        <Route path="/admin/categories">
          <AdminGuard><AdminCategoriesPage /></AdminGuard>
        </Route>
        <Route path="/admin/activities">
          <AdminGuard><AdminActivitiesPage /></AdminGuard>
        </Route>
        <Route path="/admin/guides">
          <AdminGuard><AdminGuidesPage /></AdminGuard>
        </Route>
        <Route path="/admin/journals">
          <AdminGuard><AdminJournalsPage /></AdminGuard>
        </Route>
        <Route path="/admin/enquiries">
          <AdminGuard><AdminEnquiriesPage /></AdminGuard>
        </Route>
        <Route path="/admin/email-templates">
          <AdminGuard><AdminEmailTemplatesPage /></AdminGuard>
        </Route>
        <Route path="/admin/admins">
          <AdminGuard><AdminAdminsPage /></AdminGuard>
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
            <TripProvider>
              <Router />
            </TripProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

export default App;

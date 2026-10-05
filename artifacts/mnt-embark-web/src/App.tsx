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
function OldTourLink() {
  const { slug = '' } = useParams<{ slug: string }>();
  const words = /^\d+$/.test(slug) ? '' : slug.replace(/-/g, ' ');
  return <Redirect to={words ? `/attractions?q=${encodeURIComponent(words)}` : '/attractions'} replace />;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/attractions" component={AttractionsPage} />
        <Route path="/attractions/:slug" component={AttractionDetailPage} />
        {/*
          Old addresses still in search results and bookmarks. Tours are hidden
          for now; the flights and hotels pages are gone (the flight features
          are kept on the separate "flights" branch).
        */}
        <Route path="/tours"><Redirect to="/attractions" replace /></Route>
        <Route path="/tours/:slug" component={OldTourLink} />
        <Route path="/flights"><Redirect to="/attractions" replace /></Route>
        <Route path="/flights/:slug"><Redirect to="/attractions" replace /></Route>
        <Route path="/hotels"><Redirect to="/attractions" replace /></Route>
        <Route path="/guide" component={GuidePage} />
        <Route path="/destinations" component={DestinationsPage} />
        <Route path="/categories" component={CategoriesPage} />
        <Route path="/journals" component={JournalsPage} />
        <Route path="/journals/:id" component={JournalDetailPage} />
        <Route path="/activities" component={ActivitiesPage} />
        <Route path="/activities/:slug" component={ActivityDetailPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin">
          <AdminGuard><Redirect to="/admin/attractions" /></AdminGuard>
        </Route>
        <Route path="/admin/attractions">
          <AdminGuard><AdminAttractionsPage /></AdminGuard>
        </Route>
        <Route path="/admin/tours">
          <AdminGuard><Redirect to="/admin/attractions" /></AdminGuard>
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

/**
 * Visitor chrome that sits outside any single page: the travel planner, which
 * opens as a form on a first visit and then rests as a globe at the bottom.
 *
 * Kept out of the admin area, where it would land on top of the login screen.
 */
function SiteChrome() {
  const [location] = useLocation();
  if (location.startsWith('/admin')) return null;
  return (
    <Suspense fallback={null}>
      <TripPlanner />
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
              {/*
                Inside the router because both read the current location: the
                trip bar hides itself on admin screens, where a floating
                visitor-facing form would be in the way.
              */}
              <SiteChrome />
            </TripProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

export default App;

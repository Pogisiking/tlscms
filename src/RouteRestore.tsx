import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Mitigation for SPA refresh “bounce to /” by restoring last visited route.
 * Works for all users (JWT checks removed).
 */
export function RouteRestore() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Always persist the last route for subsequent refresh.
    try {
      const lastRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      sessionStorage.setItem('last_route', lastRoute);
    } catch {
      // ignore
    }

    const last = sessionStorage.getItem('last_route');
    if (!last) return;

    const current = `${location.pathname}${location.search}${location.hash}`;
    if (last === current) return;

    // Prevent immediate restore loops.
    if (sessionStorage.getItem('last_route_restored') === '1') return;

    sessionStorage.setItem('last_route_restored', '1');
    navigate(last, { replace: true });
  }, []); // intentionally run once on boot

  return null;
}



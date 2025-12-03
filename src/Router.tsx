import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import BasePage from './pages/Base.page';

const router = createBrowserRouter([
  {
    path: '/',
    element: <BasePage />,
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}

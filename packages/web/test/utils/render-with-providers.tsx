import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavigationProvider } from '../../src/contexts/NavigationContext';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { NotesProvider } from '../../src/contexts/NotesContext';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  withRouter?: boolean;
  withTheme?: boolean;
  withNotes?: boolean;
  withNavigation?: boolean;
}

const AllTheProviders = ({
  children,
  route = '/',
}: {
  children: React.ReactNode;
  route?: string;
}) => {
  return (
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <NavigationProvider>
          <NotesProvider>{children}</NotesProvider>
        </NavigationProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    withRouter = true,
    withTheme = true,
    withNotes = true,
    withNavigation = true,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    if (!withRouter) {
      return (
        <ThemeProvider>
          <NavigationProvider>
            <NotesProvider>{children}</NotesProvider>
          </NavigationProvider>
        </ThemeProvider>
      );
    }

    return (
      <AllTheProviders route={route}>{children}</AllTheProviders>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

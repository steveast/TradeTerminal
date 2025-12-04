import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';
import { models, ModelsContext } from './models';
import { Router } from './Router';
import { theme } from './theme';

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ModelsContext.Provider value={models}>
        <Router />
      </ModelsContext.Provider>
    </MantineProvider>
  );
}

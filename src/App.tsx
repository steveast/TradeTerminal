import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';
import { Router } from './Router';
import { theme } from './theme';

import { ModelsContext, models } from "./models";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ModelsContext.Provider value={models}>
        <Router />
      </ModelsContext.Provider>
    </MantineProvider >
  );
}

import { observer } from 'mobx-react-lite';
import { Stack } from '@mantine/core';
import { TabsView } from './views/Tabs';

export const Terminal = observer(() => {
  return (
    <Stack w="25vw">
      <TabsView />
    </Stack>
  );
});

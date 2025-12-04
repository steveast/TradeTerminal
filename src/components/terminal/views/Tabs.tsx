import { useModels } from '@app/models';
import { IconChessQueen, IconFishHook } from '@tabler/icons-react';
import { Tabs } from '@mantine/core';

export function TabsView() {
  const { terminalModel } = useModels();
  return (
    <Tabs
      defaultValue={terminalModel.activeTab}
      radius={0}
      onChange={(t) => {
        terminalModel.commit({ activeTab: t as 'stopOne' | 'squeeze' });
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="stopOne" leftSection={<IconChessQueen size={14} />}>
          Stop one
        </Tabs.Tab>
        <Tabs.Tab value="squeeze" leftSection={<IconFishHook size={14} />}>
          Squeeze catcher
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="stopOne">Stop one</Tabs.Panel>

      <Tabs.Panel value="squeeze">Squeeze catcher</Tabs.Panel>
    </Tabs>
  );
}

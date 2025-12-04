import React from 'react';
import { TerminalModel } from './TerminalModel';

export const models = {
  terminalModel: new TerminalModel(),
};

export const ModelsContext = React.createContext(models);

export const useModels = () => React.useContext(ModelsContext);

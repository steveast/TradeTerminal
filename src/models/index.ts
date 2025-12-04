import React from "react";

export const models = {

};

export const ModelsContext = React.createContext(models);

export const useModels = () => React.useContext(ModelsContext);

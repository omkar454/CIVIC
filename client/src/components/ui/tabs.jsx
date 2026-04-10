import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

export const Tabs = ({ defaultValue, children, className = "" }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = "" }) => (
  <div className={`flex ${className}`}>{children}</div>
);

export const TabsTrigger = ({ value, children, className = "" }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-gray-800/50"
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = "" }) => {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}>
      {children}
    </div>
  );
};

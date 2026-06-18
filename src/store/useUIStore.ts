import { create } from 'zustand';

interface UIStore {
  activeTab: 'Fill & Sign' | 'Organize' | 'Compress' | 'Convert';
  activeTool: 'sign' | 'stamp' | 'text' | 'redact' | null;
  isInspectorOpen: boolean;
  isDrawing: boolean;
  isExporting: boolean;
  isMobileSidebarOpen: boolean;
  isPlacementMode: boolean;
  placedForConfirmation: boolean;
  lastPlacedInstanceId: string | null;
  stampPlacementMode: boolean;
  stampPlacementAsset: { url: string; aspectRatio: number } | null;
  redactPlacementMode: boolean;
  redactColor: string;
  textPlacementMode: boolean;

  setActiveTab: (tab: UIStore['activeTab']) => void;
  setActiveTool: (tool: UIStore['activeTool']) => void;
  setIsInspectorOpen: (v: boolean) => void;
  setIsDrawing: (v: boolean) => void;
  setIsExporting: (v: boolean) => void;
  setIsMobileSidebarOpen: (v: boolean) => void;
  setIsPlacementMode: (v: boolean) => void;
  setPlacedForConfirmation: (v: boolean) => void;
  setLastPlacedInstanceId: (id: string | null) => void;
  setStampPlacementMode: (v: boolean) => void;
  setStampPlacementAsset: (asset: UIStore['stampPlacementAsset']) => void;
  setRedactPlacementMode: (v: boolean) => void;
  setRedactColor: (color: string) => void;
  setTextPlacementMode: (v: boolean) => void;
  resetAllModes: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'Fill & Sign',
  activeTool: null,
  isInspectorOpen: true,
  isDrawing: false,
  isExporting: false,
  isMobileSidebarOpen: false,
  isPlacementMode: false,
  placedForConfirmation: false,
  lastPlacedInstanceId: null,
  stampPlacementMode: false,
  stampPlacementAsset: null,
  redactPlacementMode: false,
  redactColor: '#FFFFFF',
  textPlacementMode: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setIsInspectorOpen: (v) => set({ isInspectorOpen: v }),
  setIsDrawing: (v) => set({ isDrawing: v }),
  setIsExporting: (v) => set({ isExporting: v }),
  setIsMobileSidebarOpen: (v) => set({ isMobileSidebarOpen: v }),
  setIsPlacementMode: (v) => set({ isPlacementMode: v }),
  setPlacedForConfirmation: (v) => set({ placedForConfirmation: v }),
  setLastPlacedInstanceId: (id) => set({ lastPlacedInstanceId: id }),
  setStampPlacementMode: (v) => set({ stampPlacementMode: v }),
  setStampPlacementAsset: (asset) => set({ stampPlacementAsset: asset }),
  setRedactPlacementMode: (v) => set({ redactPlacementMode: v }),
  setRedactColor: (color) => set({ redactColor: color }),
  setTextPlacementMode: (v) => set({ textPlacementMode: v }),

  resetAllModes: () =>
    set({
      activeTool: null,
      isDrawing: false,
      isPlacementMode: false,
      placedForConfirmation: false,
      lastPlacedInstanceId: null,
      stampPlacementMode: false,
      stampPlacementAsset: null,
      redactPlacementMode: false,
      textPlacementMode: false,
    }),
}));

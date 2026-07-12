"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ModalOptions = {
  title: string;
  description?: string;
  content?: ReactNode;
  footer?: ReactNode;
};

type ModalContextValue = {
  openModal: (options: ModalOptions) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalOptions | null>(null);

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((options: ModalOptions) => setModal(options), []);

  const value = useMemo<ModalContextValue>(
    () => ({ closeModal, openModal }),
    [closeModal, openModal],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(modal)} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          {modal && (
            <>
              <DialogTitle>{modal.title}</DialogTitle>
              {modal.description && <DialogDescription>{modal.description}</DialogDescription>}
              {modal.content && <div className="mt-5">{modal.content}</div>}
              {modal.footer && <div className="mt-6 flex justify-end gap-2">{modal.footer}</div>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal deve ser usado dentro de ModalProvider.");
  return context;
}

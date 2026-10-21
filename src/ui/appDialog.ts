export type AppDialogButton = {
  text: string;
  role?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AppDialogOptions = {
  title: string;
  message?: string;
  buttons?: AppDialogButton[];
  buttonLayout?: "horizontal" | "vertical";
  onDismiss?: () => void;
};

type Presenter = (options: AppDialogOptions) => void;

let presenter: Presenter | null = null;

export const registerAppDialogPresenter = (nextPresenter: Presenter | null) => {
  presenter = nextPresenter;
};

export const showAppDialog = (options: AppDialogOptions) => {
  if (!presenter) return;
  presenter(options);
};

export const showAppAlert = (title: string, message?: string) => {
  showAppDialog({
    title,
    message,
    buttons: [{ text: "OK", role: "default" }],
  });
};

/** Back/outside dismissal has the same result as Cancel. */
export const confirmAppDialog = (title: string, message: string, confirmText: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (!presenter) { resolve(false); return; }
    showAppDialog({
      title, message,
      onDismiss: () => resolve(false),
      buttons: [
        { text: "Cancel", role: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
    });
  });

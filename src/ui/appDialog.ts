export type AppDialogButton = {
  text: string;
  role?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AppDialogOptions = {
  title: string;
  message?: string;
  buttons?: AppDialogButton[];
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

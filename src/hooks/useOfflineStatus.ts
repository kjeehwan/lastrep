import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

type OfflineStatus = {
  isOffline: boolean;
  ready: boolean;
};

function toOfflineState(isConnected: boolean | null, isInternetReachable: boolean | null) {
  if (isConnected === false) {
    return true;
  }

  if (isInternetReachable === false) {
    return true;
  }

  return false;
}

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOffline: false,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;

    const applyState = (isConnected: boolean | null, isInternetReachable: boolean | null) => {
      if (!mounted) return;
      setStatus({
        isOffline: toOfflineState(isConnected, isInternetReachable),
        ready: true,
      });
    };

    NetInfo.fetch()
      .then((state) => {
        applyState(state.isConnected, state.isInternetReachable);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus({
          isOffline: false,
          ready: true,
        });
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      applyState(state.isConnected, state.isInternetReachable);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return status;
}

import AppRoutes from "./routes/AppRoutes";
import { ChallengeNotificationCenter } from "./components/Challenge";
import { NotificationProvider } from "./context/notificationContext";

function App() {
  return (
    <NotificationProvider>
      <ChallengeNotificationCenter />
      <AppRoutes />
    </NotificationProvider>
  );
}

export default App;
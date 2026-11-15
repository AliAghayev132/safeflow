// Routes
import { AppRouter } from '@routes'

// Styles
import './App.css'

// Redux
import { store } from '@store'
import { Provider } from 'react-redux'

// Socket
import { SocketProvider } from '@store/context'

// Dialogs
import { ConfirmProvider } from '@components/ui'

// Provider order: Redux -> Socket (needs Redux state) -> Router
export const App = () => {
  return (
    <Provider store={store}>
      <SocketProvider>
        <ConfirmProvider>
          <AppRouter />
        </ConfirmProvider>
      </SocketProvider>
    </Provider>
  )
}

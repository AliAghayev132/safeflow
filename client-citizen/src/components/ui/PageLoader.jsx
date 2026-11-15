import { Spinner } from './Spinner'

export const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-brand">
    <Spinner className="h-8 w-8" />
  </div>
)

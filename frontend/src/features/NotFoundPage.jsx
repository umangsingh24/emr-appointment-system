import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/States.jsx';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Link to="/">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      }
    />
  );
}

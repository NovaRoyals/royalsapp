import { Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';

import { Header, Row, SignInRequired } from './personal';

export default function AccountWaiversScreen() {
  const { documents, role } = useApp();
  if (role === 'guest') return <SignInRequired title="Waivers & consents" />;
  return (
    <Screen>
      <Header title="Waivers & consents" />
      {documents.map((doc, index) => (
        <Row key={doc.id} label={doc.title} value={doc.status} last={index === documents.length - 1} />
      ))}
    </Screen>
  );
}

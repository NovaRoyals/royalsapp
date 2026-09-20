import { Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';

import { Header, Row } from './personal';

export default function AccountWaiversScreen() {
  const { documents } = useApp();
  return (
    <Screen>
      <Header title="Waivers & consents" />
      {documents.map((doc, index) => (
        <Row key={doc.id} label={doc.title} value={doc.status} last={index === documents.length - 1} />
      ))}
    </Screen>
  );
}

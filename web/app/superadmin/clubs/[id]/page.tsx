'use client';

import { use } from 'react';
import ClubScreen from './club-screen';

export default function ClubInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClubScreen id={id} tab="info" />;
}

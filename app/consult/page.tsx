import type {Metadata} from 'next';
import {PublicConsultations} from './public-consultations';
import './consult.css';

export const metadata: Metadata = {
  title: 'Find Tanzanian law and request a consultation',
  description: 'Search official Tanzanian legal sources in Kiswahili or English and request a consultation with a verified advocate.',
  alternates: {canonical:'/consult'},
};

export default function ConsultPage() {
  return <PublicConsultations/>;
}

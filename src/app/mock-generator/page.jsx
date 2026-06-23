import MockDataGenerator from './MockDataGenerator';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/content';

export const metadata = {
  title: 'Mock Data Factory',
  description: 'Generate high-fidelity, relational mock data by pasting SQL, JSON, or TypeScript schemas.',
};

export default function MockGeneratorPage() {
  const footerContent = getToolContent('mock-generator');
  
  return (
   <>
    <MockDataGenerator />
    <ToolFooter content={footerContent} />
   </>
  );
}
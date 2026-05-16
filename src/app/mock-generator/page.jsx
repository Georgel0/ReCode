import MockDataGenerator from './MockDataGenerator';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'Enterprise Mock Data Factory | AI Tools',
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
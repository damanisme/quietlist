import './globals.css'; 
 
export const metadata = {
  title: 'Quietlist — the to-do list that keeps quiet',
  description: 'Privacy-first task manager with opt-in AI subtask breakdown. No account, no cloud — your data stays in your browser.',
};
 
export default function RootLayout({ children }) { 
  return ( 
    <html lang="en"> 
      <body>{children}</body> 
    </html> 
  ); 
} 

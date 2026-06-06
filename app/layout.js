import './globals.css'; 
 
export const metadata = { 
  title: 'Task Master', 
  description: 'A modern task management application', 
}; 
 
export default function RootLayout({ children }) { 
  return ( 
    <html lang="en"> 
      <body>{children}</body> 
    </html> 
  ); 
} 

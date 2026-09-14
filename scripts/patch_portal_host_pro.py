from pathlib import Path
p=Path('app/page.tsx')
s=p.read_text()
s=s.replace('import { PortalHost } from "@/components/legal-eye-portal";','import { PortalHostPro } from "@/components/legal-eye-portal-host";')
s=s.replace('<PortalHost identity={identity} connect={connect} documents={vaultDocuments}/>','<PortalHostPro identity={identity} connect={connect} documents={vaultDocuments}/>')
p.write_text(s)
print('portal host pro activated')
# triggered

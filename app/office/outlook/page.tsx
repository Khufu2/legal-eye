import Script from "next/script";
import { LegalEyeOffice } from "@/components/legal-eye-office";

export default function OutlookAddInPage(){return <><Script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" strategy="beforeInteractive"/><LegalEyeOffice host="outlook"/></>;}

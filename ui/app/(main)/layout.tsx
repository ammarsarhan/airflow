import Navigation from "@/app/components/Navigation";

export default function MainLayout({ children } : { children: React.ReactNode }) {
    return (
        <>
            <Navigation/>
            {children}
        </>
    )
}
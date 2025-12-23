export default function AuthLayout({ children } : { children: React.ReactNode }) {
    return (
        <div className="h-screen grid grid-cols-[2fr_2fr_1fr] gap-x-4 p-4">
            {children}
            <div className="rounded-md bg-black h-[calc(100vh-2rem)] overflow-clip">
                <video className="h-full w-full object-cover block" autoPlay loop muted>
                    <source src="/videos/auth-1.mp4" type="video/mp4" />
                </video>
            </div>
            <div className="rounded-md bg-black h-[calc(100vh-2rem)] overflow-clip">
                <video className="h-1/2 w-full object-cover block" autoPlay loop muted>
                    <source src="/videos/auth-2.mp4" type="video/mp4" />
                </video>
                <video className="h-1/2 w-full object-cover block" autoPlay loop muted>
                    <source src="/videos/auth-3.mp4" type="video/mp4" />
                </video>
            </div>
        </div>
    )
}
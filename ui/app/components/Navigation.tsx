import Link from "next/link";
import Button from "@/app/components/Button";

import { FaChevronDown } from "react-icons/fa6";
import { IoIosAirplane } from "react-icons/io";

export function NavigationDropdown({ label } : { label: string }) {
    return (
        <div className="flex items-center gap-x-1.5 py-2 px-3 rounded-md border border-gray-300 bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer">
            <span className="text-xs font-medium">{label}</span>
            <FaChevronDown className="size-2" />
        </div>
    )
}

export function NavigationButton({ label } : { label: string }) {
    return (
        <div className="flex items-center py-2 px-3 rounded-md border border-gray-300 bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer">
            <span className="text-xs font-medium">{label}</span>
        </div>
    )
}

export default function Navigation() {
    return (
        <nav className="flex items-center justify-between p-4 border-b border-gray-300">
            <div className="flex items-center gap-x-8">
                <Link href="/" className="flex items-center gap-x-1.25 hover:text-gray-700 transition-colors">
                    <IoIosAirplane className="size-5 -rotate-45"/>
                    <span className="font-bold">Airflow</span>
                </Link>
                <div className="flex items-center gap-x-2">
                    <NavigationDropdown label="Flights"/>
                    <NavigationDropdown label="Crew"/>
                    <NavigationDropdown label="Cargo"/>
                    <NavigationButton label="Accounting"/>
                    <NavigationDropdown label="Reports"/>
                    <NavigationDropdown label="Routes"/>
                    <NavigationButton label="Settings"/>
                </div>
            </div>
            <div className="flex items-center gap-x-3">
                <Link href="/auth/user/sign-up">
                    <Button label="Sign Up" link/>
                </Link>
            </div>
        </nav>
    )
}
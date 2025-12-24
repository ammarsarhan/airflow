import { FaArrowRight } from "react-icons/fa6";

interface ButtonProps {
    label: string;
    link?: boolean;
}

export default function Button({ label, link = false } : ButtonProps) {
    return (
        <button className="group flex items-center justify-center gap-x-2 px-6 py-3 rounded-full bg-black hover:bg-black/75 transition-colors cursor-pointer text-white">
            <span className="text-xs">{label}</span>
            {
                link &&
                <FaArrowRight className="size-2.5 rotate-0 group-hover:-rotate-45 transition-all"/>
            }
        </button>
    )
}
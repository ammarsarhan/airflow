import { ChangeEvent } from "react";

interface InputProps {
    label?: string;
    placeholder: string;
    value: string;
    type?: "text" | "password";
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export default function Input({ label, placeholder, value, type = "text", onChange } : InputProps) {
    return (
        <div className="flex flex-col gap-y-1.75 text-xxs w-full">
            {
                label &&
                <span className="font-medium">{label}</span>
            }
            <input 
                type={type}
                className="w-full px-3 py-2.5 rounded-md bg-gray-200 outline-0"
                placeholder={placeholder} 
                value={value} 
                onChange={onChange}
            />
        </div>
    )
};

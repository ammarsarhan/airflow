"use client";

import Link from "next/link";
import { useReducer } from "react";
import Input from "@/app/components/Input";

import { IoIosAirplane } from "react-icons/io";
import Button from "@/app/components/Button";

interface SignInFormState {
    email: string;
    password: string;
    showPassword: boolean;
}

interface SignUpFormAction {
    type: "SET",
    payload: Partial<SignInFormState>
}

function reducer(state: SignInFormState, action: SignUpFormAction) {
    switch (action.type) {
        case "SET":
            return {
                ...state,
                ...action.payload
            }
    }
};

export default function SignUp() {
    const [state, dispatch] = useReducer(reducer, {
        email: "",
        password: "",
        showPassword: false
    });

    return (
        <form className="flex flex-col items-center justify-center relative h-full p-6 bg-gray-100 rounded-md">
            <Link href="/" className="absolute top-6 left-6 flex items-center gap-x-1.25 hover:text-gray-700 transition-colors">
                <IoIosAirplane className="size-5 -rotate-45"/>
                <span className="font-bold">Airflow</span>
            </Link>
            <div className="flex flex-col items-center gap-y-4 w-full">
                <div className="flex flex-col gap-y-1 w-full mb-2">
                    <h1 className="text-2xl font-semibold text-left w-full">Sign In To Airflow</h1>
                    <p className="text-xxs text-gray-700 max-w-3/4">Log in as a passenger or a manager to view your flights and actions.</p>
                </div>
                <Input 
                    value={state.email} 
                    onChange={(e) => dispatch({ type: "SET", payload: { email: e.target.value } })} 
                    label="Email"
                    placeholder="Email Address"
                />
                <div className="w-full">
                    <Input 
                        value={state.password} 
                        onChange={(e) => dispatch({ type: "SET", payload: { password: e.target.value } })} 
                        label="Password" 
                        type={state.showPassword ? "text" : "password"}
                        placeholder="Password"
                    />
                    <div className="flex items-center gap-x-2 text-xxs mt-2.25">
                        <input type="checkbox" checked={state.showPassword} onChange={() => dispatch({ type: "SET", payload: { showPassword: !state.showPassword }})}/>
                        <span>Show password</span>
                    </div>
                </div>
                <Button label="Sign In"/>
            </div>
            <p className="absolute bottom-4 text-xxs my-2">Don&apos;t have an account? <Link href="/auth/user/sign-up" className="text-blue-800 hover:underline">Sign Up</Link></p>
        </form>
    )
}
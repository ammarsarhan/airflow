"use client";

import Link from "next/link";
import { useReducer } from "react";
import Input from "@/app/components/Input";

import { IoIosAirplane } from "react-icons/io";
import Button from "@/app/components/Button";

interface SignUpFormState {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    showPassword: boolean;
}

interface SignUpFormAction {
    type: "SET",
    payload: Partial<SignUpFormState>
}

function reducer(state: SignUpFormState, action: SignUpFormAction) {
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
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
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
                <h1 className="text-2xl font-semibold mb-2 text-left w-full">Sign Up To Airflow <br/> As A Passenger</h1>
                <div className="flex items-center gap-x-4 w-full">
                    <Input 
                        value={state.firstName} 
                        onChange={(e) => dispatch({ type: "SET", payload: { firstName: e.target.value } })} 
                        label="First Name" 
                        placeholder="First Name"
                        />
                    <Input 
                        value={state.lastName} 
                        onChange={(e) => dispatch({ type: "SET", payload: { lastName: e.target.value } })} 
                        label="Last Name" 
                        placeholder="Last Name"
                    />
                </div>
                <Input 
                    value={state.phone} 
                    onChange={(e) => dispatch({ type: "SET", payload: { phone: e.target.value } })} 
                    label="Phone" 
                    placeholder="Phone Number"
                />
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
                <Button label="Create Account"/>
            </div>
            <p className="absolute bottom-4 text-xxs my-2">Already have an account? <Link href="/auth/sign-in" className="text-blue-800 hover:underline">Sign In</Link></p>
        </form>
    )
}
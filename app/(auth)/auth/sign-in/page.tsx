import React from "react";
import Image from "next/image";
import SignInFormClient from "@/modules/auth/components/sign-in-form-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In",
    description: "Sign in to your PoiEx account.",
};

const Page = () => {
    return (
        <>
            <Image
                src={"/login.svg"}
                alt="Login-Image"
                height={300}
                width={300}
                className="m-6 object-cover"
            />
            <SignInFormClient />
        </>
    );
};

export default Page;

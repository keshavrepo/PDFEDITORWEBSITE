import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Check if Google OAuth is configured
const isGoogleConfigured = 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET;

const handler = NextAuth({
  providers: isGoogleConfigured ? [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ] : [],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
});

export { handler as GET, handler as POST };

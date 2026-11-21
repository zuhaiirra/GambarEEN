
const supabaseUrl = "https://ipfluhoiwibedcouypyy.supabase.co";

const supabaseKey = "sb_publishable_Gp1Nngbw5qLT4NXv6LCIUg_XqG5sWqu";

if (!window.supabase) {
    console.error("Library Supabase gagal dimuat!");
} else {
    window.supabaseClient = window.supabase.createClient(
        supabaseUrl,
        supabaseKey
    );

    var supabaseClient = window.supabaseClient;

    console.log("Supabase berhasil terhubung!");
}

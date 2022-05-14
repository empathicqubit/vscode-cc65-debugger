#include <unistd.h>

#if !defined(CLOCKS_PER_SEC)
unsigned __fastcall__ sleep (unsigned wait)
{
}
#endif

unsigned char test_pause_main(void) {
    while(1) {
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
        sleep(1);
    }

    return 0;
}
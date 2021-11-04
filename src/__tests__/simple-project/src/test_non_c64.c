#include <conio.h>

void step_pet() {
    cputs("If you see this after step\n");
    cputs("in, you failed\n");
}

unsigned char test_non_c64_main(void) {
    step_pet();
    cputs("If you see this after step\n");
    cputs("out, you failed\n");
    return 0;
}
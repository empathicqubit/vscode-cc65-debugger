#include <conio.h>

void stepOut() {
    cputs("If you see this after step\n");
    cputs("in, you failed\n");
}

unsigned char test_step_out_main(void) {
    stepOut();
    cputs("If you see this after step\n");
    cputs("out, you failed\n");
    return 0;
}